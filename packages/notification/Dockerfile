ARG  BRANCH=develop
FROM oni1003/ocrvs-base:${BRANCH}

USER node

WORKDIR /app/packages/notification
COPY --chown=node:node packages/notification /app/packages/notification
RUN yarn install --frozen-lockfile && yarn build

CMD [ "yarn", "start:prod" ]
