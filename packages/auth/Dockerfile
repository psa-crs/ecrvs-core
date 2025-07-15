ARG  BRANCH=develop
FROM oni1003/ocrvs-base:${BRANCH}

USER node

WORKDIR /app/packages/auth
COPY --chown=node:node packages/auth/*.json /app/packages/auth/
RUN yarn install --frozen-lockfile
COPY --chown=node:node packages/auth /app/packages/auth
RUN yarn build

CMD ["yarn", "start:prod"]
