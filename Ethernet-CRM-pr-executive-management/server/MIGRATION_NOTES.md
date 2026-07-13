# Database Migration Notes

## Purchase Request Item - Material Type Column Change

### Change Required
The `material_type` column in the `purchase_request_items` table needs to be changed from ENUM to VARCHAR(100) to support dynamic material types.

### SQL Migration Script

```sql
-- For PostgreSQL
ALTER TABLE purchase_request_items 
ALTER COLUMN material_type TYPE VARCHAR(100);

-- For MySQL
ALTER TABLE purchase_request_items 
MODIFY COLUMN material_type VARCHAR(100) NOT NULL;

-- For SQLite (requires table recreation)
-- Note: SQLite doesn't support ALTER COLUMN, so you'll need to:
-- 1. Create a new table with the correct schema
-- 2. Copy data from old table
-- 3. Drop old table
-- 4. Rename new table
```

### Why This Change?
- Previously, material types were hardcoded as ENUM: 'components', 'raw material', 'finish product', 'supportive material', 'cable'
- Now, material types are stored in the `material_types` table and can be dynamically added/removed
- This allows users to create custom material types through the UI

### Backward Compatibility
- Existing data will be preserved
- The validation now checks against the `material_types` table dynamically
- If no material types exist in the database, validation will allow any non-empty string (for backward compatibility)

### Testing
After running the migration:
1. Verify existing purchase requests still load correctly
2. Test creating a new purchase request with existing material types
3. Test creating a new purchase request with a new material type from the `material_types` table
4. Verify validation errors show correct list of valid material types

