FROM mhart/alpine-node:7

RUN sed -i -e 's/v[0-9]\.[0-9]/edge/g' /etc/apk/repositories \
 && echo "@testing http://dl-4.alpinelinux.org/alpine/edge/testing" >> /etc/apk/repositories \
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
    libunwind \
    git \
    util-linux \
    python \
    linux-headers

WORKDIR /build
RUN git clone git://github.com/zeromq/czmq.git \
 && cd czmq \
 && ./autogen.sh \
 && ./configure --prefix=/usr \
 && make \
 && make install

WORKDIR /build
RUN git clone git://github.com/zeromq/zyre.git \
 && cd zyre \
 && ./autogen.sh \
 && ./configure --prefix=/usr \
 && make \
 && make install

WORKDIR /build/tdrs
ADD . .
RUN npm install --unsafe-perm

CMD ["npm", "run", "DiscoveryClient"]
