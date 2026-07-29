# Build the React front-end and run the Node/Express server that serves it and
# the /api endpoints. Data (including profile photos) lives in the attached Neon
# PostgreSQL database via DATABASE_URL — nothing is written to the container's
# ephemeral filesystem, so redeploys never lose data.
FROM node:20-slim
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source and build the front-end into dist/
COPY . .
RUN npm run build

ENV NODE_ENV=production
# Rabbit provides PORT; the server reads process.env.PORT (defaults to 3000).
EXPOSE 3000
# The server creates its schema on startup. To seed the three demo submissions on
# an empty database, set SEED_DEMO=1 in the Rabbit service env.
CMD ["node", "server.js"]
