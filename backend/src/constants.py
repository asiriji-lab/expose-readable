"""
Sentinel constants for missing schedule entities.

Used in grid cell values to signal "this entity was not available for this slot"
without silently omitting data. Exporters convert sentinels to null in output.
"""

NO_CLASS   = "NO_CLASS"    # slot has no student class (e.g. elective, scout)
NO_ROOM    = "NO_ROOM"     # slot has no assigned room
NO_TEACHER = "NO_TEACHER"  # slot has no assigned teacher
