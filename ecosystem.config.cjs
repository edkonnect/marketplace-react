module.exports = {
  apps: [
    {
      name: "tutor-marketplace",
      script: "dist/index.js",
      env: {
        EMAIL_HOST: "email-smtp.us-east-1.amazonaws.com",
        EMAIL_PORT: "587",
        EMAIL_USER: "AKIAU2DBYC3BKJPEGK52",
        EMAIL_PASSWORD: "BF+yciTDZU158Q2qAQ6ltjKhVLPZvc5jVE+SbsJFg0ox",
        EMAIL_FROM: "no-reply@edkonnect-academy.com",
	STRIPE_BYPASS: "false",
        STRIPE_SECRET_KEY: "sk_live_cQQkMOzbgk4wXFsE7eBbWtWD00WQU5nACL",
        STRIPE_PUBLISHABLE_KEY: "pk_live_F8Kdup18YKEZuj1eQPkpZKKF00b34lzslH1",
        STRIPE_WEBHOOK_SECRET: "whsec_3bZp9VI9I2HLV9h5yo0h6BiewRWtzpLJ",
        GEMINI_API_KEY: "AIzaSyDeriXM5FU8NmYJmeHylQoOgyac766qXdo",
        ACUITY_USER_ID: "18852823",
        ACUITY_API_KEY: "bc59ae0823601e5a1ce172dab15221c7",
        ADMIN_NOTIFICATION_EMAIL: "admin@edkonnect-academy.com",
      }
    }
  ]
};
