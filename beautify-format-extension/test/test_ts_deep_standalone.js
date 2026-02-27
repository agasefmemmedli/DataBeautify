"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const js_deep_formatter_1 = require("../src/formatters/js_deep_formatter");
const testCode = `
import{SomeImport}from'some-module';

interface  ComplexInterface < T , U=string > extends SomeImport{
    prop1:T;
    prop2?:U;
    method1(arg1:T,arg2:U):Promise<void>;
    readonly prop3:{nested:boolean};
}

@decorator ( { options:true } )
class  MyClass < T >  implements ComplexInterface < T > {
    prop1:T;
    prop2?:string;

    constructor(private readonly service:SomeService){
        this.prop1=service.getProp();
    }

    async method1(arg1:T,arg2:string="default"):Promise<void>{
        const result = await this.service.call(arg1,arg2);
        const value=result?.data?.items??[];

        switch(typeof arg1){
            case 'string':
                console.log(\`Template literal: \${arg1}\`);
                break;
            case 'number':
                if(arg1>10){
                    return;
                }
                break;
            default:
                throw new Error('Unknown type');
        }

        const mapped=value.map((item:any)=>{
            return{
                id:item.id,
                name:item.name?.toUpperCase(),
            };
        });
    }

    get prop3(){
        return{nested:true};
    }
}

type MyType=string|(number&{tag:string});

function complexFunction({x=0,y=0}:{x?:number;y?:number}):number{
    return x+y;
}
`;
console.log('--- Testing formatJSDeep directly ---');
try {
    const formatted = (0, js_deep_formatter_1.formatJSDeep)(testCode, {
        tabSize: 4,
        insertSpaces: true,
        printWidth: 120
    });
    console.log(formatted);
}
catch (e) {
    console.error('Formatting failed:', e);
}
//# sourceMappingURL=test_ts_deep_standalone.js.map