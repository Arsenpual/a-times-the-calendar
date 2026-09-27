export function createActivityMetadataActions({
  lockedActivities,
  setLockedActivities,
  setActivityLocked,
  fetchLockedActivities,
  setError,
  checkConflict,
  setActivityCategoryMap,
  assignActivityCategory,
  fetchActivityCategoryMap,
  createCategory,
  deleteCategory,
  setCategories
}) {
  const handleToggleLock = async (activityId, locked) => {
    setLockedActivities((previous) => {
      const next = { ...previous };
      if (locked) next[activityId] = true;
      else delete next[activityId];
      return next;
    });
    try {
      await setActivityLocked(activityId, locked);
    } catch (error) {
      setError(`${locked ? "ล็อก" : "ปลดล็อก"}กิจกรรมไม่สำเร็จ: ${error.message}`);
      fetchLockedActivities().then(setLockedActivities).catch(() => {});
    }
  };

  const handleAssignCategory = async (activityId, categoryId) => {
    if (lockedActivities[activityId]) {
      setError("กิจกรรมนี้ถูกล็อกไว้ — ปลดล็อกก่อนเปลี่ยนหมวดหมู่");
      return;
    }
    const conflict = await checkConflict(activityId);
    setActivityCategoryMap((previous) => {
      const next = { ...previous };
      if (categoryId) next[activityId] = categoryId;
      else delete next[activityId];
      return next;
    });
    try {
      await assignActivityCategory(activityId, categoryId);
      if (conflict) {
        setError("กิจกรรมนี้ถูกแก้ไขที่อื่นหลังจากโหลดข้อมูลล่าสุด — บันทึกทับข้อมูลนั้นแล้ว");
      }
    } catch (error) {
      setError(`บันทึกหมวดหมู่ไม่สำเร็จ: ${error.message}`);
      fetchActivityCategoryMap().then(setActivityCategoryMap).catch(() => {});
    }
  };

  const handleCreateCategory = async (name, color) => {
    const newCategory = await createCategory(name, color);
    setCategories((previous) => [...previous, newCategory]);
    return newCategory;
  };

  const handleDeleteCategory = async (categoryId) => {
    await deleteCategory(categoryId);
    setCategories((previous) => previous.filter((category) => category.id !== categoryId));
    setActivityCategoryMap((previous) => {
      const next = { ...previous };
      for (const activityId of Object.keys(next)) {
        if (next[activityId] === categoryId) delete next[activityId];
      }
      return next;
    });
  };

  return {
    handleToggleLock,
    handleAssignCategory,
    handleCreateCategory,
    handleDeleteCategory
  };
}
