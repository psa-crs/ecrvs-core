ARG  BRANCH=develop
FROM oni1003/ocrvs-base:${BRANCH}

USER node

WORKDIR /app/packages/search
COPY --chown=node:node packages/search /app/packages/search
RUN yarn install --frozen-lockfile && yarn build


CMD [ "yarn", "start:prod" ]

