interface User{
id:number;
name:string;
email?:string
}

function greet(user:User){
console.log("Hello, "+user.name+"!");
}

const user={id:1,name:"John Doe"};
greet(user);

// Messy part
   const  calculate  =  ( a : number ,  b : number ) : number  =>  {
return a+b;
}

// Syntax error (missing closing brace)
function broken() {
console.log("Broken"
