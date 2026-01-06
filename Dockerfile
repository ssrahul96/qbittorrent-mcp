FROM node:24.12-alpine3.22

RUN mkdir -p /app/src

WORKDIR /app/src

COPY package*.json ./

RUN npm install --only=production

COPY . .

EXPOSE 8000

ENV QBITTORRENT_HOST=http://127.0.0.1:8080
ENV QBITTORRENT_USERNAME=admin
ENV QBITTORRENT_PASSWORD=adminadmin

CMD ["node", "index.ts"]
