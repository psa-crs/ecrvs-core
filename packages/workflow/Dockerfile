ARG  BRANCH=develop
FROM oni1003/ocrvs-base:${BRANCH}

USER node

WORKDIR /app/packages/workflow
COPY --chown=node:node packages/workflow /app/packages/workflow
RUN yarn install --frozen-lockfile && yarn build

CMD [ "yarn", "start:prod" ]
