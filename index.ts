const port = process.env.PORT || 3000;

const server = Bun.serve({
  port: Number(port),
  routes: {
    "/": () => new Response('Bun!'),
  }
});

console.log(`Listening on ${server.url}`);