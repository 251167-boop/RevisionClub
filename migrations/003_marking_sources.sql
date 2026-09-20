-- Freeze the creator's marking context alongside immutable paper versions.
CREATE TABLE rc_version_context (
  version_id TEXT PRIMARY KEY REFERENCES rc_versions(id),
  instructions TEXT NOT NULL DEFAULT ''
);
CREATE TABLE rc_version_files (
  version_id TEXT NOT NULL REFERENCES rc_versions(id),
  file_id TEXT NOT NULL REFERENCES rc_files(id),
  PRIMARY KEY(version_id,file_id)
);
INSERT INTO rc_version_context SELECT v.id,p.description FROM rc_versions v JOIN rc_papers p ON p.id=v.paper_id;
INSERT INTO rc_version_files SELECT v.id,f.file_id FROM rc_versions v JOIN rc_paper_files f ON f.paper_id=v.paper_id;
