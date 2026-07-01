FROM node:18-alpine
WORKDIR /app
RUN apk add --no-cache bash postgresql-client
COPY seed/package.json ./seed/package.json
COPY seed/seed.js ./seed/seed.js
WORKDIR /app/seed
RUN npm install
ENV PATH=/app/seed/node_modules/.bin:$PATH
CMD ["node", "/app/seed/seed.js"]