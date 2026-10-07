import { AbstractFileBrowser } from "../../abstract-fs";
import config from "../config.json";
import "../../abstract-fs/dist/style.css";

export default function App() {
  const hostname = `http://localhost:${config.port}`;
  const provider = async () => {
    const response = await fetch(`${hostname}/storage/tree/`);

    if (!response.ok) {
      throw new Error(
        `Error making request to fetch content| Status: ${response.status}`,
      );
    }

    const data = await response.json();
    console.log(data);
    return data;
  };
  return <AbstractFileBrowser provider={provider} />;
}
