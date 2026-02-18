// Complex TypeScript Test Case

function sealed(constructor: Function) {
Object.seal(constructor);
Object.seal(constructor.prototype);
}

interface User {
id: string | number;
name: string;
email?: string;
}

interface Repository<T, K> {
findById(id: K): Promise<T | null>;
save(entity: T): Promise<void>;
}

type UserID = string | number;
type AdminUser = User & { role: 'admin' };

@sealed
class UserRepository implements Repository<User, UserID> {
private db: Map<UserID, User>;

constructor() {
this.db = new Map();
}

async findById(id: UserID): Promise<User | null> {
const user = this.db.get(id) ?? null;
return user;
}

async save(entity: User): Promise<void> {
this.db.set(entity.id, entity);
}
}

const maxSafe = 9_007_199_254_740_991n;

const htmlTemplate = /* html */ `
<div>
<span>Hello</span>
</div>
`;

const config = {
app: {
name: "MyApp",
version: "1.0.0",
features: ["auth", "logging", "api"]
},
env: process.env.NODE_ENV || "development",
"invalid-identifier": true,
validIdentifier: true
};
