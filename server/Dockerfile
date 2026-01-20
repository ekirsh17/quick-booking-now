# Use Node.js 20 LTS
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files (server only)
COPY server/package*.json ./

# Install dependencies (skip scripts to avoid validation)
RUN npm ci --ignore-scripts

# Copy source files
COPY server/ ./

# Build TypeScript (direct compilation, no npm scripts)
RUN npx tsc -p tsconfig.json

# Expose port
EXPOSE 3001

# Start the server
CMD ["npm", "start"]
