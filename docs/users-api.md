# Users API Documentation

REST API Lambda function for managing user data in DynamoDB.

## Environment Variables

- `USERS_TABLE`: Name of the DynamoDB table for users (e.g., `users`)

## HTTP Methods & Endpoints

### POST - Create User

Creates a new user with auto-generated userId.

**Request:**
```bash
curl -X POST https://api.example.com/users \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "birthday": "1990-01-19",
    "timezone": "America/New_York"
  }'
```

**Request Body:**
- `firstName` (string, required): User's first name
- `lastName` (string, required): User's last name
- `birthday` (string, required): User's birthday in ISO format (YYYY-MM-DD)
- `timezone` (string, required): User's timezone (must be valid IANA timezone)

**Response (201 Created):**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Errors:**
- `400 Bad Request`: Missing required fields or invalid timezone/birthday format
- `500 Internal Server Error`: Database error

---

### GET - Get User

Retrieves user details by userId.

**Request:**
```bash
curl https://api.example.com/users?userId=user-123
```

**Query Parameters:**
- `userId` (string, required): The user ID to retrieve

**Response (200 OK):**
```json
{
  "userId": { "S": "user-123" },
  "firstName": { "S": "John" },
  "lastName": { "S": "Doe" },
  "birthday": { "S": "1990-01-19" },
  "timezone": { "S": "America/New_York" },
  "createdAt": { "S": "2026-01-19T10:00:00.000Z" }
}
```

**Errors:**
- `404 Not Found`: User with ID {userId} not found
- `500 Internal Server Error`: Database error

---

### PUT - Update User

Updates user's timezone. Only timezone can be modified.

**Request:**
```bash
curl -X PUT https://api.example.com/users?userId=user-123 \
  -H "Content-Type: application/json" \
  -d '{
    "timezone": "Europe/London"
  }'
```

**Query Parameters:**
- `userId` (string, required): The user ID to update

**Request Body:**
- `timezone` (string, required): New timezone (must be valid IANA timezone)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User updated successfully"
}
```

**Errors:**
- `400 Bad Request`: Invalid timezone or attempting to update firstName/lastName/birthday
- `500 Internal Server Error`: Database error

---

### DELETE - Delete User

Deletes a user by userId.

**Request:**
```bash
curl -X DELETE https://api.example.com/users?userId=user-123
```

**Query Parameters:**
- `userId` (string, required): The user ID to delete

**Response (204 No Content):**
Empty response body

**Errors:**
- `500 Internal Server Error`: Database error

---

## Validation Rules

1. **firstName & lastName**: Required, non-empty strings
2. **Birthday**: Valid ISO 8601 date format (YYYY-MM-DD)
3. **Timezone**: Must be a valid IANA timezone
   - Examples: `America/New_York`, `Europe/London`, `Asia/Tokyo`
   - Get all valid timezones: `Intl.supportedValuesOf("timeZone")`

---

## Error Response Format

All error responses follow this format:
```json
{
  "statusCode": 400,
  "headers": {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
  },
  "body": {
    "error": "Error type",
    "message": "Descriptive error message"
  }
}
```

---

## cURL Examples

### Create a new user
```bash
curl -X POST https://api.example.com/users \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "birthday": "1992-06-15",
    "timezone": "Europe/London"
  }'
```

Response:
```json
{
  "statusCode": 201,
  "body": {
    "success": true,
    "message": "User created successfully",
    "data": {
      "userId": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
    }
  }
}
```

### Update user timezone
```bash
curl -X PUT https://api.example.com/users?userId=user-123 \
  -H "Content-Type: application/json" \
  -d '{
    "timezone": "Asia/Tokyo"
  }'
```

Response:
```json
{
  "statusCode": 200,
  "body": {
    "success": true,
    "message": "User updated successfully"
  }
}
```

### Get user details
```bash
curl https://api.example.com/users?userId=user-123
```

Response:
```json
{
  "statusCode": 200,
  "body": {
    "userId": { "S": "user-123" },
    "firstName": { "S": "Jane" },
    "lastName": { "S": "Smith" },
    "birthday": { "S": "1992-06-15" },
    "timezone": { "S": "Asia/Tokyo" },
    "createdAt": { "S": "2026-01-19T12:30:00.000Z" }
  }
}
```

### Get non-existent user
```bash
curl https://api.example.com/users?userId=nonexistent
```

Response:
```json
{
  "statusCode": 404,
  "body": {
    "error": "Not found",
    "message": "User with ID nonexistent not found"
  }
}
```

### Delete a user
```bash
curl -X DELETE https://api.example.com/users?userId=user-123
```

Response: 204 No Content (empty body)

---

## Validation Examples

### Valid Birthday Formats
```
1990-01-19  ✓ Correct
1992-06-15  ✓ Correct
2000-12-31  ✓ Correct
```

### Invalid Birthday Formats
```
01/19/1990  ✗ Wrong format
1990-1-19   ✗ Missing zero-padding
19-01-1990  ✗ Wrong order
invalid     ✗ Not a date
```

### Valid Timezones
```
America/New_York
Europe/London
Asia/Tokyo
Australia/Sydney
America/Los_Angeles
Europe/Paris
Asia/Shanghai
```

### Invalid Timezones
```
NewYork
London
UTC+5
America/Invalid
```

---

## Implementation Notes

1. **Idempotency**: User IDs are generated using UUID v4
2. **Timezone Validation**: Uses JavaScript `Intl.supportedValuesOf("timeZone")`
3. **Birthday Storage**: Stored in ISO 8601 format (YYYY-MM-DD)
4. **CORS**: All responses include CORS headers for cross-origin requests
5. **Timestamps**: Creation timestamps stored in ISO 8601 format with timezone

---

## Database Schema

### Users Table

```
Partition Key: userId (String)

Attributes:
- userId: String (Primary Key)
- firstName: String
- lastName: String
- birthday: String (ISO 8601: YYYY-MM-DD)
- timezone: String
- createdAt: String (ISO 8601 with timezone)
```

Example item:
```json
{
  "userId": { "S": "user-123" },
  "firstName": { "S": "John" },
  "lastName": { "S": "Doe" },
  "birthday": { "S": "1990-01-19" },
  "timezone": { "S": "America/New_York" },
  "createdAt": { "S": "2026-01-19T10:00:00.000Z" }
}
```
