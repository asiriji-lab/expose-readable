import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testSignup() {
    const timestamp = Date.now();
    const testEmail = `testadmin${timestamp}@example.com`;

    console.log(`Attempting to sign up: ${testEmail}...`);

    const { data, error } = await supabase.auth.signUp({
        email: testEmail,
        password: 'password123',
        options: {
            data: {
                username: `admin_${timestamp}`,
                first_name: 'Test',
                last_name: 'Admin',
                role: 'admin'
            }
        }
    });

    if (error) {
        console.error('Signup Error:', error)
    } else {
        console.log('Signup Success! The email should be in the "unverified" state now.');
    }
}

testSignup()
