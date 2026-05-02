FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN rm -f .env
RUN npx prisma generate
RUN npm run build
EXPOSE 4000
CMD ["node", "dist/index.js"]
