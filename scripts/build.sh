#!/bin/sh
# Mark all pre-existing migrations as applied, then deploy new ones
npx prisma migrate resolve --applied 20260512000000_init
npx prisma migrate resolve --applied 20260512100000_restaurant_fields
npx prisma migrate resolve --applied 20260512110000_item_tags
npx prisma migrate resolve --applied 20260516000000_add_owner_role
npx prisma migrate resolve --applied 20260516100000_restaurant_location
npx prisma migrate resolve --applied 20260524000000_add_restaurant_kds_view
npx prisma migrate resolve --applied 20260524100000_add_restaurant_palette_orders
npx prisma migrate resolve --applied 20260525000000_order_item_served_at
npx prisma migrate resolve --applied 20260526000000_add_category_auto_ready
npx prisma migrate resolve --applied 20260526100000_add_restaurant_splash_image
npx prisma migrate resolve --applied 20260530000000_password_policy_and_user_flags
npx prisma migrate resolve --applied 20260601000000_add_shift_manager_role
npx prisma migrate resolve --applied 20260608000000_add_loyalty_permissions
npx prisma migrate resolve --applied 20260608000003_add_auth_lockout_totp
npx prisma migrate resolve --applied 20260609000000_add_restaurant_admin_palette
npx prisma migrate resolve --applied 20260610000000_add_allergens_to_item
npx prisma migrate resolve --applied 20260610100000_add_allergens_to_order
npx prisma migrate resolve --applied 20260610200000_manager_pin_void_comp
npx prisma migrate resolve --applied 20260611000000_order_item_served_by
npx prisma migrate resolve --applied 20260611100000_add_waiter_station
npx prisma migrate resolve --applied 20260614120000_siteconfig_extended
npx prisma migrate deploy
next build
