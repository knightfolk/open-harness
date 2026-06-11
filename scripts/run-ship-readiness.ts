import { resolve } from 'node:path';
import { runShipReadiness } from '../server/shipReadiness';

const args = process.argv.slice(2);
const json = args.includes('--json');
const targetArg = args.find((arg) => !arg.startsWith('--')) || '.';
const report = runShipReadiness(resolve(targetArg));

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`${report.status.toUpperCase()}: ${report.summary}`);
  console.log(`Project: ${report.projectDir}`);
  for (const item of report.checks) {
    console.log(`- ${item.status.toUpperCase()} ${item.label}: ${item.detail}`);
  }
  if (report.recommendedNextSteps.length > 0) {
    console.log('Next steps:');
    for (const step of report.recommendedNextSteps) console.log(`- ${step}`);
  }
}

if (report.status !== 'pass') process.exitCode = 1;
