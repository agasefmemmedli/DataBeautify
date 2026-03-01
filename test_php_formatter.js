const { formatPHPDeep } = require('./beautify-format-extension/out/formatters/php_deep_formatter');
const code = `<?php
namespace App\\Services;
use App\\Models\\User;
use Illuminate\\Support\\Facades\\Log;

class UserService
{
    private $userRepository;
}
`;
console.log(formatPHPDeep(code));
