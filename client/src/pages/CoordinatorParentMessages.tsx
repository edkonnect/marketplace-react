import { useEffect } from "react";
import { useLocation, useParams } from "wouter";

/**
 * Coordinator view of a specific parent's messages
 * Redirects to the main messages page with parentId filter
 */
export function CoordinatorParentMessages() {
  const { parentId } = useParams<{ parentId: string }>();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Redirect to main messages page with parentId filter
    setLocation(`/messages?parentId=${parentId}`);
  }, [setLocation, parentId]);

  return null;
}
