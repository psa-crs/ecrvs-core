ARG  BRANCH=develop
FROM ghcr.io/psa-crs/ocrvs-base:release-v1.9.12

USER node
WORKDIR /app/packages/auth
COPY --chown=node:node packages/auth/*.json /app/packages/auth/
RUN yarn install --frozen-lockfile
COPY --chown=node:node packages/auth /app/packages/auth
RUN yarn build

CMD ["yarn", "start:prod"]
