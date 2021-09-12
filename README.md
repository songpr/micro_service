# micro_node
minimal node micro service framework on top of fastify

## Concept
micro service framework, routes are grouped into service based on service setting, services are grouped into node base on setting - to save cost on instances.

Routes in the same service share same fastify plug-in

Each service can have independent fastify plug-in
## Installation:

```javascript
npm install mservice-node --save
```

## Usage:

```javascript
const ms_node = require("mservice-node");