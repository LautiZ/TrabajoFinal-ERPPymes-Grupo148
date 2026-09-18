import * as dotenv from 'dotenv';
import * as path from 'path';

export function loadAppEnv(appName: string): void {
  const envPath = path.resolve(process.cwd(), `apps/${appName}/.env`);
  dotenv.config({ path: envPath });
}
