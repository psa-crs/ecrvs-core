ARG  BRANCH=develop
FROM ghcr.io/psa-crs/ocrvs-base:release-v1.9.12

USER node

WORKDIR /app/packages/user-mgnt
COPY --chown=node:node packages/user-mgnt /app/packages/user-mgnt
RUN yarn install --frozen-lockfile && yarn build

CMD ["yarn", "start:prod"]
