/**
 * Seed script used by migrator container.
 * It will retry DB connections until DBs are ready.
 * Environment variables inherited from docker-compose.
 */
const { Pool } = require('pg');
const axios = require('axios');
const bcrypt = require('bcrypt');

const AUTH_DB = process.env.AUTH_DATABASE_URL || 'postgresql://postgres:postgres@auth-db:5432/auth_db';
const USER_DB = process.env.USER_DATABASE_URL || 'postgresql://postgres:postgres@user-db:5432/user_db';
const EXAM_DB = process.env.EXAM_DATABASE_URL || 'postgresql://postgres:postgres@exam-db:5432/exam_db';
const SUB_DB = process.env.SUBMISSION_DATABASE_URL || 'postgresql://postgres:postgres@submission-db:5432/submission_db';
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || 'service_token';
const RESULT_SERVICE_URL = process.env.RESULT_SERVICE_URL || 'http://result-service:3005';

function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function waitForDb(connectionString, name) {
  for (let i=0;i<60;i++){
    try {
      const pool = new Pool({ connectionString });
      await pool.query('SELECT 1');
      await pool.end();
      console.log(`${name} is ready`);
      return;
    } catch (err) {
      console.log(`Waiting for ${name}...`);
      await wait(2000);
    }
  }
  throw new Error(`${name} did not become ready`);
}

async function run(){
  try {
    await waitForDb(AUTH_DB, 'auth_db');
    await waitForDb(USER_DB, 'user_db');
    await waitForDb(EXAM_DB, 'exam_db');
    await waitForDb(SUB_DB, 'submission_db');

    const authPool = new Pool({ connectionString: AUTH_DB });
    const userPool = new Pool({ connectionString: USER_DB });
    const examPool = new Pool({ connectionString: EXAM_DB });
    const subPool = new Pool({ connectionString: SUB_DB });

    // ensure roles already inserted via init.sql; but double-check
    await authPool.query("INSERT INTO roles (name) VALUES ('admin') ON CONFLICT DO NOTHING");
    await authPool.query("INSERT INTO roles (name) VALUES ('teacher') ON CONFLICT DO NOTHING");
    await authPool.query("INSERT INTO roles (name) VALUES ('student') ON CONFLICT DO NOTHING");

    async function createUser(username, email, password, role) {
      const hash = await bcrypt.hash(password, 10);
      const r = await authPool.query('INSERT INTO users(username,email,password_hash) VALUES($1,$2,$3) ON CONFLICT (username) DO UPDATE SET email=EXCLUDED.email RETURNING id,username', [username, email, hash]);
      const user = r.rows[0];
      const rr = await authPool.query('SELECT id FROM roles WHERE name=$1', [role]);
      if (rr.rows[0]) {
        await authPool.query('INSERT INTO user_roles (user_id,role_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [user.id, rr.rows[0].id]);
      }
      return user;
    }

    const admin = await createUser('admin', 'admin@example.com', 'admin123', 'admin');
    const teacher = await createUser('teacher1', 'teacher1@example.com', 'teach123', 'teacher');
    const student = await createUser('student1', 'student1@example.com', 'stud123', 'student');
    console.log('users created:', admin.username, teacher.username, student.username);

    await userPool.query('INSERT INTO profiles(user_id,full_name,role,class) VALUES($1,$2,$3,$4) ON CONFLICT (user_id) DO UPDATE SET full_name=EXCLUDED.full_name', [admin.id, 'Site Admin', 'admin', null]);
    await userPool.query('INSERT INTO profiles(user_id,full_name,role,class) VALUES($1,$2,$3,$4) ON CONFLICT (user_id) DO UPDATE SET full_name=EXCLUDED.full_name', [teacher.id, 'Teacher One', 'teacher', 'Class A']);
    await userPool.query('INSERT INTO profiles(user_id,full_name,role,class) VALUES($1,$2,$3,$4) ON CONFLICT (user_id) DO UPDATE SET full_name=EXCLUDED.full_name', [student.id, 'Student One', 'student', 'Class A']);
    console.log('profiles upserted');

    const examRes = await examPool.query('INSERT INTO exams (title, description, created_by, is_published, published_at, duration_minutes) VALUES ($1,$2,$3,$4,now(),$5) RETURNING id', ['Demo Exam', 'Simple demo exam', teacher.id, true, 30]);
    const examId = examRes.rows[0].id;
    const qRes = await examPool.query('INSERT INTO questions (exam_id,text,type,points,order_index) VALUES ($1,$2,$3,$4,$5) RETURNING id', [examId, '2 + 2 = ?', 'single_choice', 1, 1]);
    const qId = qRes.rows[0].id;
    await examPool.query('INSERT INTO question_options (question_id,code,text,is_correct) VALUES ($1,$2,$3,$4)', [qId, 'A', '3', false]);
    await examPool.query('INSERT INTO question_options (question_id,code,text,is_correct) VALUES ($1,$2,$3,$4)', [qId, 'B', '4', true]);
    await examPool.query('INSERT INTO question_options (question_id,code,text,is_correct) VALUES ($1,$2,$3,$4)', [qId, 'C', '5', false]);
    console.log('exam created:', examId);

    const subRes = await subPool.query('INSERT INTO submissions (exam_id,user_id,status,submitted_at) VALUES ($1,$2,$3,now()) RETURNING id', [examId, student.id, 'submitted']);
    const submissionId = subRes.rows[0].id;
    await subPool.query('INSERT INTO submission_answers (submission_id,question_id,selected_options) VALUES ($1,$2,$3)', [submissionId, qId, JSON.stringify('B')]);
    console.log('demo submission created:', submissionId);

    // Try call result service to grade
    try {
      await axios.post(`${RESULT_SERVICE_URL}/results/grade`, { submission_id: submissionId, exam_id: examId, user_id: student.id }, { headers: { 'x-service-token': SERVICE_TOKEN } });
      console.log('grading requested');
    } catch (err) {
      console.warn('grading call failed (maybe result-service not up yet):', err.message);
    }

    console.log('Seed complete');
    await authPool.end();
    await userPool.end();
    await examPool.end();
    await subPool.end();
    process.exit(0);
  } catch (err) {
    console.error('Seed failed', err);
    process.exit(1);
  }
}

run();