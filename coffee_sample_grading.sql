-- Add new columns to harvest_data for coffee sample grading
ALTER TABLE harvest_data
  ADD COLUMN bag_weight float8 CHECK (bag_weight > 0),
  ADD COLUMN processing_method int2 CHECK (processing_method IN (0, 1)),
  ADD COLUMN colors int2 CHECK (colors IN (0, 1, 2)),
  ADD COLUMN moisture float8 CHECK (moisture >= 0 AND moisture <= 20),
  ADD COLUMN category_one_defects int2 CHECK (category_one_defects >= 0),
  ADD COLUMN category_two_defects int2 CHECK (category_two_defects >= 0); 