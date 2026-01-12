# **App Name**: OffshoreBrucke

## Core Features:

- User Signup: Allows users to sign up with email and password, selecting either Germany or India during registration to determine user role.
- Automatic Role Assignment: Assigns user roles (buyer/supplier) based on their selected country during signup. Germany = buyer, India = supplier.
- Admin User Creation: Admins are manually created in Firestore with the 'admin' role assigned. to login for prototype add this cridts : email: admin@gmail.com password: 11111111
- Login & Redirection: Users are redirected to their respective portals (/buyer, /supplier, /admin) after successful login, based on their role.
- Buyer Portal: Dashboard for buyers with header branding, sidebar navigation (empty links), and a 'Buyer Portal' display, logged-in email, and role badge.
- Supplier Portal: Dashboard for suppliers with header branding, sidebar navigation (empty links), and a 'Supplier Portal' display, logged-in email, and role badge.
- Admin Portal: Simple admin portal with 'Admin Portal' display, logged-in email, and a role badge with gold accent, designed as a control panel.
- Access Control: Route guards on every portal that validate the user's role against Firestore, redirecting unauthorized access attempts to the login page.

## Style Guidelines:

- Primary color: Deep Blue (#0F4C81) to establish trust and professionalism, drawing inspiration from established European B2B software aesthetics.
- Secondary color: Complementary Blue (#1F6FA8) for a cohesive and calming user interface, ensuring a balance between visual appeal and brand recognition.
- Accent color: Gold (#C9A24D) used sparingly for key UI elements like 'Verified' badges and admin actions, conveying a premium and trustworthy feel without being too flashy. A softer gold (#E6D8A3) and darker gold (#A8842C) may be used for appropriate emphasis in other parts of the app.
- Background color: App background set to off-white (#F9F7F4) to ensure a clean and modern look.
- Card background: Pure White (#FFFFFF) for the dashboard cards to keep the app uncluttered.
- Text color: Primary text color should be set to dark gray (#0F1F2E), with a secondary text color (#4A5A6A) for less important copy, ensuring high readability.
- Font: 'Inter', a sans-serif, for both headlines and body text, providing a clean and neutral look.
- Dashboard-first experience that remains mobile responsive to allow easy navigation across devices
- Cards in dashboard to have soft shadows and rounded corners (6-10px) for softer, modern look.
- Simple page transitions between buyer, supplier and admin pages.