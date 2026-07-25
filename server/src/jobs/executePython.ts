import logger from '../logger.js';
import { exec } from 'child_process';
import fs from 'fs';
const { promises: fsPromises } = fs;

type ExecutePythonScriptArgs = {
  script: string;
  cwd?: string;
  args?: string[];
};
// Resolves once the script has actually finished (not just been spawned), so callers
// that need to run scripts in sequence (e.g. one script depends on data the previous
// one wrote) can `await` it. Callers that don't await it keep the old fire-and-forget
// behavior.
export const executePythonScript = async ({ script, args = [] }: ExecutePythonScriptArgs): Promise<void> => {
  const pythonExecutable = '/home/dac/venv/bin/python';

  try {
    await fsPromises.access(pythonExecutable, fs.constants.X_OK);
  } catch {
    logger.debug(`Not executing python script, ${pythonExecutable} does not exist!`);
    return;
  }

  const command = `${pythonExecutable} -B ${script} ${args.join(' ')}`;
  logger.info(`Executing: ${command}`);

  return new Promise<void>((resolve) => {
    exec(command, { env: { ...process.env } }, (error, stdout, stderr) => {
      if (error) {
        logger.error(`Execution error: ${error.message}`);
        resolve();
        return;
      }
      if (stderr) {
        logger.error(`Python stderr: ${stderr}`);
      }
      if (stdout) {
        logger.info(`Python stdout: ${stdout}`);
      }
      resolve();
    });
  });
};
