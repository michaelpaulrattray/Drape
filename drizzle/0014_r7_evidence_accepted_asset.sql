ALTER TABLE `model_identity_feature_versions`
  MODIFY COLUMN `sourceAssetId` int,
  ADD `acceptedAssetId` int,
  ADD CONSTRAINT `uq_identity_feature_versions_accepted_asset` UNIQUE(`acceptedAssetId`);
