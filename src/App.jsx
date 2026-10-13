export default function App({ Page }) {
  return Page ? <Page /> : <main style={{ padding: "4rem", fontFamily: "system-ui" }}><h1>Page not found</h1></main>;
}
