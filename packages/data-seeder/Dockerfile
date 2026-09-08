ARG  BRANCH=develop
FROM ghcr.io/psa-crs/ocrvs-base:release-v1.9.16

USER node

WORKDIR /app/packages/data-seeder
COPY --chown=node:node packages/data-seeder/*.json /app/packages/data-seeder/
RUN yarn install --frozen-lockfile
COPY --chown=node:node packages/data-seeder /app/packages/data-seeder
ENTRYPOINT [ "sh", "-c", "yarn seed" ]