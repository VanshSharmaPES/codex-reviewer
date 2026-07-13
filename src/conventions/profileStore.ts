import fs from 'fs';
import path from 'path';
import { conventionProfileSchema, ConventionProfile } from './types';

export function readProfile(profilePath: string): ConventionProfile { return conventionProfileSchema.parse(JSON.parse(fs.readFileSync(profilePath, 'utf8'))); }
export function writeProfile(profilePath: string, profile: ConventionProfile): void { const valid = conventionProfileSchema.parse(profile); fs.mkdirSync(path.dirname(profilePath), { recursive: true }); const temp = `${profilePath}.${process.pid}.tmp`; fs.writeFileSync(temp, `${JSON.stringify(valid, null, 2)}\n`); fs.renameSync(temp, profilePath); }
