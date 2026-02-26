
import * as fs from 'fs';
import * as path from 'path';
import { formatJavaDeep } from './src/formatters/java_deep_formatter';

const filePath = path.join(__dirname, '../reproduce_java.java');
const content = fs.readFileSync(filePath, 'utf-8');

const formatted = formatJavaDeep(content);
console.log(formatted);
