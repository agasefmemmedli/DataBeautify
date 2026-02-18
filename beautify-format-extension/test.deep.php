<?php
namespace App\Services; use App\Models\User;
use Illuminate\Support\Facades\Log;

class UserService {
private $userRepository;

public function __construct($userRepository) {
$this->userRepository = $userRepository;
}

public function processUser(User $user, array $data): bool {
if (empty($data)) {
return false;
}

foreach ($data as $key => $value) {
if ($key === 'password') {
$user->password = bcrypt($value);
} else {
$user->$key = $value;
}
}

try {
$user->save();
return true;
} catch (\Exception $e) {
Log::error('Error saving user: ' . $e->getMessage());
return false;
}
}

public function renderProfile(User $user) {
?>
<div class="user-profile">
<h1><?php echo htmlspecialchars($user->name); ?></h1>
<ul>
<?php foreach ($user->roles as $role): ?>
<li><?php echo $role->name; ?></li>
<?php endforeach; ?>
</ul>
</div>
<?php
}
}
