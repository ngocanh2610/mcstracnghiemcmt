import os

files = [
    ".vscode/settings.json", "api-gateway/Dockerfile", "api-gateway/src/index.ts",
    "docker-compose.yml", "frontend/package.json", "frontend/src/App.css",
    "frontend/src/App.jsx", "frontend/src/components/Auth.jsx", "frontend/src/config.js",
    "frontend/src/pages/Admin.jsx", "frontend/src/pages/Profile.jsx", "frontend/src/pages/Student.jsx",
    "frontend/src/pages/Teacher.jsx", "services/auth-service/src/index.ts",
    "services/auth-service/tsconfig.json", "services/exam-service/src/index.ts",
    "services/submission-service/src/index.ts"
]

out = []
for fpath in files:
    if not os.path.exists(fpath): continue
    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
    if "<<<<<<< HEAD" in content:
        out.append(f"\n====================== {fpath} ======================")
        lines = content.split('\n')
        in_conflict = False
        conflict_lines = []
        for line in lines:
            if line.startswith("<<<<<<< HEAD"):
                in_conflict = True
                conflict_lines.append(line)
            elif line.startswith("======="):
                conflict_lines.append(line)
            elif line.startswith(">>>>>>> origin/khanh"):
                conflict_lines.append(line)
                in_conflict = False
                out.append('\n'.join(conflict_lines))
                out.append("-----------------------------------------------------")
                conflict_lines = []
            elif in_conflict:
                conflict_lines.append(line)

with open("scratch_conflicts.txt", "w", encoding="utf-8") as f:
    f.write('\n'.join(out))
