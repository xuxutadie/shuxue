FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY public ./public
COPY data.js exams.js exam-legacy.js pretest-v3.js ./
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8766
USER node
EXPOSE 8766
CMD ["node", "server/index.js"]
