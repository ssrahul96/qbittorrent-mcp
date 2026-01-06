FROM node:22.15-alpine3.21

RUN mkdir -p /app/src

WORKDIR /app/src

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

RUN npm prune --production

EXPOSE 8000

ENV QBITTORRENT_HOST=http://127.0.0.1:8080
ENV QBITTORRENT_USERNAME=admin
ENV QBITTORRENT_PASSWORD=adminadmin

CMD ["node", "dist/index.js"]