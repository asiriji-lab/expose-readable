# Frontend Integration Guide for GA Scheduler API

This guide provides instructions and examples on how to connect a frontend application (e.g., React, Next.js, Vue) to the GA Scheduler Flask API.

## Base URL & Configuration

- **Local Development URL**: `http://localhost:5000`
- **CORS**: Enabled by default for all origins (`*`) under the `/api/*` prefix. You will not face CORS issues during local development when making API requests from `http://localhost:3000` (or similar).
- **Swagger Documentation**: You can view the full interactive OpenAPI documentation by visiting `http://localhost:5000/apidocs` in your browser while the server is running. This is the best place to find exact payload shapes.

---

## Authentication

The API uses **JWT (JSON Web Tokens)** for authentication. Protected endpoints require the token to be sent in the `Authorization` header.

### 1. Register a new user
**POST** `/api/v1/auth/register`

```javascript
const response = await fetch('http://localhost:5000/api/v1/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securepassword',
    name: 'Admin User'
  })
});
const data = await response.json();
```

### 2. Login to receive an access token
**POST** `/api/v1/auth/login`

```javascript
const response = await fetch('http://localhost:5000/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securepassword'
  })
});
const data = await response.json();
const token = data.access_token; // Save to memory, localStorage, or cookies
```

### 3. Making Authenticated Requests
For any protected route, attach the token as a Bearer token:

```javascript
headers: {
  'Authorization': `Bearer ${token}`
  // ... other headers
}
```

---

## Main Workflow: Generating a Timetable

The core functionality (using the Genetic Algorithm to generate a timetable) is an asynchronous job workflow. You MUST submit the job, poll the server for its progress, and download/load the results when it finishes.

### Step 1: Submit a Scheduling Job
**POST** `/api/v1/schedule`

You will need to submit the necessary CSV files (curriculum, teachers, rooms, etc.) via `multipart/form-data`.

```javascript
const formData = new FormData();
// Important: Ensure the field names perfectly match what the backend expects
formData.append('curriculum', fileInputCurriculum.files[0]);
formData.append('teacher', fileInputTeacher.files[0]);
formData.append('room', fileInputRoom.files[0]);
// Optionally append parameters
formData.append('academic_year', '2026');
formData.append('semester', '1');

const response = await fetch('http://localhost:5000/api/v1/schedule', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
    // NOTE: Do NOT set 'Content-Type': 'multipart/form-data' manually.
    // The browser sets it automatically with the correct boundary.
  },
  body: formData
});

const data = await response.json();
const jobId = data.job_id; // Keep track of this ID!
```

### Step 2: Poll for Job Status
Because the GA algorithm takes time, poll the status endpoint until completion.

**GET** `/api/v1/schedule/<job_id>`

```javascript
async function pollJobStatus(jobId) {
  const response = await fetch(`http://localhost:5000/api/v1/schedule/${jobId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  
  if (data.status === 'processing' || data.status === 'pending') {
    // 1. Update UI progress bar
    console.log(`Processing... Progress: ${data.progress}%`);
    // 2. Poll again in 2 seconds
    setTimeout(() => pollJobStatus(jobId), 2000);
    
  } else if (data.status === 'completed') {
    // 3. Job is done! Render results or show success message
    console.log('Success! Results:', data.results);
    
  } else if (data.status === 'failed') {
    // 4. Handle error state
    console.error('Job failed:', data.error);
  }
}
```

### Step 3: Download or View Results
Once the job is completed, you might want to visualize the generated timetable directly in the frontend using the JSON returned in Step 2, or you can allow the user to download the generated CSVs as a ZIP package.

**GET** `/api/v1/schedule/<job_id>/download`

```javascript
// Simple download link trigger
function triggerDownload(jobId) {
  window.open(`http://localhost:5000/api/v1/schedule/${jobId}/download`, '_blank');
}
```

---

## Other Essential Endpoints

- **`/`**: Returns basic service metadata and a full list of available endpoints.
- **`/health`**: Use this to check if the backend service and database are up before allowing users to log in.
- **`GET /api/v1/jobs`**: List all historically submitted scheduling jobs.
- **`GET /api/v1/schedules`**: List saved schedules (supports filters like `?org_id=xyz`).
- **`DELETE /api/v1/schedule/<job_id>`**: Cancel or delete a job.
- **`POST /api/v1/auth/logout`**: Standard logout endpoint.

## Best Practices

1. **Error Handling**: The API implements standardized error formats. Always check `response.ok` or catch thrown fetch errors. Errors will typically return a generic shape like `{ "message": "...", "status_code": 400 }`.
2. **File Size/Types**: Ensure the frontend restricts file uploads to `.csv` format before sending them to the `POST /api/v1/schedule` endpoint.
3. **Swagger Integration**: If your frontend uses a strongly-typed language (e.g., TypeScript), consider using the Swagger `apispec.json` output (`http://localhost:5000/apispec.json`) to automatically generate your API client and interfaces using tools like `openapi-typescript-codegen`.
