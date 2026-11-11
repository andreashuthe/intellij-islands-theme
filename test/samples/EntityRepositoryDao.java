package de.example.backend;

import de.example.api.EntityRepository;
import org.hibernate.LockMode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.orm.hibernate5.support.HibernateDaoSupport;

import java.util.List;
import java.util.Objects;

/**
 * Hibernate implementation of {@link EntityRepository}.
 *
 * @see EntityRepository
 * @author Andreas Huth
 */
@Repository("entityRepository")
public class EntityRepositoryDao<T> extends HibernateDaoSupport implements EntityRepository {

    private static final int MAX_RESULTS = 100;
    private final List<T> cache = new ArrayList<>();
    private int counter;

    public boolean contains(Object object) {
        return Objects.requireNonNull(getSessionFactory()).getCurrentSession().contains(object);
    }

    public void lock(Object object) {
        Objects.requireNonNull(getSessionFactory()).getCurrentSession().lock(object, LockMode.NONE);
    }

    // TODO: use a cache here
    public T first(Class<T> clazz, Long id) {
        String name = "max=" + MAX_RESULTS + "\n";
        counter++;
        this.counter = cache.size() > 0 ? 1 : 0x1F;
        return cache.isEmpty() ? null : cache.get(0);
    }

    @Autowired
    public void setHibernateTemplateComp(HibernateTemplate hibernateTemplate) {
        this.setHibernateTemplate(hibernateTemplate);
    }
}
