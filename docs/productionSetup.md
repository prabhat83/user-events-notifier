# Production Setup Guide

Complete guide for deploying the Birthday Notification System to AWS production environment.

## Overview

This guide walks through setting up a complete production deployment with:
- 3 Lambda functions (Users API, Birthday Scheduler, Notification Delivery)
- 2 DynamoDB tables (users, sentMessages)
- 1 SQS FIFO queue
- 1 SNS topic
- 1 EventBridge rule
- IAM roles and policies
- Monitoring and logging

## Architecture Diagram

```
┌─────────────────┐
│  API Gateway    │
│  (REST API)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌─────────────────┐
│   Users API     │─────▶│  DynamoDB       │
│   Lambda        │      │  users table    │
└─────────────────┘      └─────────────────┘
                                 ▲
                                 │
┌─────────────────┐              │
│  EventBridge    │              │
│  (every minute) │              │
└────────┬────────┘              │
         │                       │
         ▼                       │
┌─────────────────┐              │
│  Scheduler      │──────────────┘
│  Lambda         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  SQS FIFO       │
│  Queue          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌─────────────────┐
│  Notification   │─────▶│  DynamoDB       │
│  Delivery       │      │  sentMessages   │
│  Lambda         │      │  table          │
└────────┬────────┘      └─────────────────┘
         │
         ▼
┌──────────────────────────┐
│  SNS Topic / RequestBin  │
│  (Notifications).        │
└──────────────────────────┘
```

## Prerequisites

- AWS CLI installed and configured
- Node.js 18.x or later
- npm or yarn
- AWS account with appropriate permissions
- Basic understanding of AWS services

## Step 1: DynamoDB Tables

### Create Users Table

```bash
aws dynamodb create-table \
  --table-name users \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --tags Key=Environment,Value=Production Key=Project,Value=BirthdayNotifier
```

```bash
aws dynamodb update-table \
  --table-name users \
  --attribute-definitions AttributeName=timezone,AttributeType=S \
  --global-secondary-index-updates \
    '[{
      "Create": {
        "IndexName": "timezone-index",
        "KeySchema": [{"AttributeName":"timezone","KeyType":"HASH"}],
        "Projection": {"ProjectionType":"ALL"}
      }
    }]'
```
### Create Sent Messages Table

```bash
aws dynamodb create-table \
  --table-name sentMessages \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
    AttributeName=messageKey,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
    AttributeName=messageKey,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --tags Key=Environment,Value=Production Key=Project,Value=BirthdayNotifier
```

## Step 2: SQS Queue

Create FIFO Queue
i.g. `https://sqs.us-east-1.amazonaws.com/123456789012/birthday-notifications.fifo`

## Step 3: SNS Topic

Create SNS Topic
i.g. `arn:aws:sns:us-east-1:123456789012:birthday-notifications`

## Step 4: RequestBin (Optional)
Create a RequestBin for testing webhook notifications
e.g. `https://requestbin.example.com/abc123`

## Step 5: IAM Roles and Policies

### User API Lambda Role

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": [
                "dynamodb:PutItem",
                "dynamodb:GetItem",
                "dynamodb:DeleteItem"
            ],
            "Resource": "arn:aws:dynamodb:*:*:table/users"
        }
    ]
}
```

### Scheduler Lambda Role

#### DynamoDB

```
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Sid": "VisualEditor0",
			"Effect": "Allow",
			"Action": [
				"dynamodb:Query"
			],
			"Resource": [
				"arn:aws:dynamodb:ap-southeast-1:215151307926:table/users",
				"arn:aws:dynamodb:ap-southeast-1:215151307926:table/users/index/timezone-index"
			]
		}
	]
}
```

#### SQS

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": "sqs:SendMessage",
            "Resource": "arn:aws:sqs:ap-southeast-1:*:user_events.fifo"
        }
    ]
}
```

### Notification Delivery Lambda Role

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": "dynamodb:PutItem",
            "Resource": "arn:aws:dynamodb:*:*:table/sentMessages"
        }
    ]
}
```