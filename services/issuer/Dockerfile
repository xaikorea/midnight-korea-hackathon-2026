FROM node:24-bookworm-slim
WORKDIR /issuer
ENV NODE_ENV=production ISSUER_HOST=0.0.0.0 ISSUER_PORT=3201 ISSUER_DATA_DIR=/issuer-data
RUN groupadd -g 10002 issuer && useradd -u 10002 -g issuer issuer
COPY --chown=10002:10002 services/issuer/*.mjs ./
USER 10002
EXPOSE 3201
CMD ["node","server.mjs"]
