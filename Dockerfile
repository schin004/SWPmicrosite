# Build the front-end and run the Node server that serves it + the /api endpoints.
FROM node:20-slim
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source and build the front-end into dist/
COPY . .
RUN npm run build

ENV NODE_ENV=production
# Rabbit provides PORT; the server reads process.env.PORT (defaults to 3000)
EXPOSE 3000
CMD ["node", "server.js"]
