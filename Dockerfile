FROM node:24-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npx", "ts-node", "src/index.ts"]
