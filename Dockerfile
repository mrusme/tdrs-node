FROM mhart/alpine-node:7

RUN echo "@testing http://dl-4.alpinelinux.org/alpine/edge/testing" >> /etc/apk/repositories \
 && apk update \
 && apk add --no-cache \
    bash \
    file \
    build-base \
    make \
    g++ \
    autoconf \
    automake \
    libtool \
    zeromq@testing \
    zeromq-dev@testing \
    libzmq@testing  \
    libsodium \
    libsodium-dev \
    git \
    util-linux \
    python \
    linux-headers

WORKDIR /build/tdrs
ADD . .
RUN npm install --unsafe-perm

CMD ["npm", "run", "DiscoveryClient"]
