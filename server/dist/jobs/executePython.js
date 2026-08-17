import logger from '../logger.js';
import { exec } from 'child_process';
import fs from 'fs';
const { promises: fsPromises } = fs;
// Resolves once the script has actually finished (not just been spawned), so callers
// that need to run scripts in sequence (e.g. one script depends on data the previous
// one wrote) can `await` it. Callers that don't await it keep the old fire-and-forget
// behavior.
export const executePythonScript = async ({ script, args = [] }) => {
    const pythonExecutable = '/home/dac/venv/bin/python';
    try {
        await fsPromises.access(pythonExecutable, fs.constants.X_OK);
    }
    catch {
        logger.debug(`Not executing python script, ${pythonExecutable} does not exist!`);
        return;
    }
    const command = `${pythonExecutable} -B ${script} ${args.join(' ')}`;
    logger.info(`Executing: ${command}`);
    return new Promise((resolve) => {
        // Sensor-array debug logging can produce well over Node's default 1MB
        // stdout/stderr cap on a real overnight window, which silently kills the
        // process before it can update job status - raise it well above anything
        // this script realistically prints.
        exec(command, { env: { ...process.env }, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
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
//# sourceMappingURL=executePython.js.map