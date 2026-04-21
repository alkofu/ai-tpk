import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export function writeDotfile(name: string, value: string): void {
  const dotfilePath = path.join(os.homedir(), ".claude", "." + name);
  const dotfileDir = path.dirname(dotfilePath);
  fs.mkdirSync(dotfileDir, { recursive: true });
  fs.writeFileSync(dotfilePath, value + "\n", {
    mode: 0o600,
    encoding: "utf8",
  });
}
