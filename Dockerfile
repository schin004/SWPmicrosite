# Build the React front-end and run the Node/Express server that serves it,
# the /api endpoints, and uploaded photos. Node 22 is required for the built-in
# node:sqlite module used for local persistence.
FROM node:22-slim
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source and build the front-end into dist/
COPY . .
RUN npm run build

ENV NODE_ENV=production
# The server reads process.env.PORT (defaults to 3001)
EXPOSE 3001
# Seed the database on first boot, then start the server (which serves dist/).
CMD ["sh", "-c", "node seed.js && node server.js"]
