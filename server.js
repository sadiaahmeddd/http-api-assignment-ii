/* eslint-disable no-console */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { StringDecoder } = require('string_decoder');
const querystring = require('querystring');

const port = process.env.PORT || 3000;

// user store
const users = {};

/* \ helpers */

const send = (res, status, headers, body, method) => {
  if (headers) {
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  }
  res.statusCode = status;

  // 204 and HEAD 
  if (status === 204 || method === 'HEAD') {
    res.end();
    return;
  }
  res.end(body);
};

const sendJSON = (res, status, obj, method) =>
  send(res, status, { 'Content-Type': 'application/json' }, JSON.stringify(obj), method);

const sendNotFound = (res, method) =>
  sendJSON(res, 404, { message: 'The resource you requested was not found.', id: 'notFound' }, method);

const readFileSafe = (filePath, contentType, res) => {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
};

const parseBody = (req) =>
  new Promise((resolve) => {
    const decoder = new StringDecoder('utf8');
    let buffer = '';

    req.on('data', (chunk) => { buffer += decoder.write(chunk); });
    req.on('end', () => {
      decoder.end();

      const ct = req.headers['content-type'] || '';
      let data = {};

      if (ct.includes('application/json')) {
        try { data = JSON.parse(buffer || '{}'); } catch { data = {}; }
      } else if (ct.includes('application/x-www-form-urlencoded')) {
        data = querystring.parse(buffer);
      } else if (buffer) {
        try { data = JSON.parse(buffer); } catch { data = querystring.parse(buffer); }
      }

      resolve(data);
    });
  });

/* - route handlers - */

const handleRoot = (req, res) => {
  if (req.method !== 'GET') return sendNotFound(res, req.method);
  const filePath = path.join(__dirname, 'client', 'client.html');
  return readFileSafe(filePath, 'text/html', res);
};

const handleStyle = (req, res) => {
  if (req.method !== 'GET') return sendNotFound(res, req.method);
  const filePath = path.join(__dirname, 'client', 'style.css');
  return readFileSafe(filePath, 'text/css', res);
};

const handleGetUsers = (req, res) => {
  if (req.method === 'GET') return sendJSON(res, 200, { users }, 'GET');
  if (req.method === 'HEAD') return send(res, 200, { 'Content-Type': 'application/json' }, null, 'HEAD');
  return sendNotFound(res, req.method);
};

const handleNotReal = (req, res) => {
  if (req.method === 'GET') {
    return sendJSON(res, 404, { message: 'This endpoint does not exist.', id: 'notFound' }, 'GET');
  }
  if (req.method === 'HEAD') return send(res, 404, { 'Content-Type': 'application/json' }, null, 'HEAD');
  return sendNotFound(res, req.method);
};

const handleAddUser = async (req, res) => {
  if (req.method !== 'POST') return sendNotFound(res, req.method);

  const body = await parseBody(req);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const ageNum = Number(body.age);
  const hasAge = Number.isFinite(ageNum);

  if (!name || !hasAge) {
    return sendJSON(res, 400, { message: 'Name and age are both required.', id: 'missingParams' }, 'POST');
  }

  const exists = Object.prototype.hasOwnProperty.call(users, name);
  if (exists) {
    users[name].age = ageNum;
    return send(res, 204, { 'Content-Type': 'application/json' }, null, 'POST'); // no body
  }

  users[name] = { name, age: ageNum };
  return sendJSON(res, 201, { message: 'Created Successfully', user: users[name] }, 'POST');
};

/*  server  */

const server = http.createServer((req, res) => {
  const { pathname } = url.parse(req.url);

  // static
  if (pathname === '/') return handleRoot(req, res);
  if (pathname === '/style.css') return handleStyle(req, res);

  // api
  if (pathname === '/getUsers') return handleGetUsers(req, res);
  if (pathname === '/notReal') return handleNotReal(req, res);
  if (pathname === '/addUser') return handleAddUser(req, res);

  // catch-all 404 
  if (req.method === 'GET') {
    return sendJSON(res, 404, { message: 'The resource you requested was not found.', id: 'notFound' }, 'GET');
  }
  if (req.method === 'HEAD') {
    return send(res, 404, { 'Content-Type': 'application/json' }, null, 'HEAD');
  }
  return sendNotFound(res, req.method);
});

;

//http://localhost:3000/
server.listen(port, () => {
  console.log(`Server running at http://localhost:${3000}/`);
});
